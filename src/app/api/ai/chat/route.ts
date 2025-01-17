import { NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import { generateChatResponse } from '@/lib/openai';
import { processResponse } from '@/lib/response-processing';
import { formatContextForPrompt } from '@/lib/context-assembly';
import { env } from '@/lib/env';
import { createClient } from '@supabase/supabase-js';
import { preprocessText } from '@/lib/embeddings';
import { semanticSearch } from '@/lib/semantic-search';

// Initialize Supabase client
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

interface MessageWithRelations {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  channel_id: string;
  profiles: {
    id: string;
    username: string;
    created_at: string;
  };
  channels: {
    id: string;
    name: string;
    description: string | null;
    is_private: boolean;
    is_direct_message: boolean;
    created_at: string;
    updated_at: string;
    created_by: string;
  };
}

export async function POST(request: Request) {
  try {
    const { query, channelId } = await request.json();

    if (!query?.trim()) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    console.log('Processing query:', query, 'for channel:', channelId);

    // Preprocess the query
    const processedQuery = preprocessText(query);
    console.log('Preprocessed query:', processedQuery);

    try {
      // Perform semantic search to find relevant messages
      const searchResults = await semanticSearch({
        query: processedQuery,
        channelId,
      });

      console.log('Search returned results:', searchResults.length);

      if (!searchResults?.length) {
        console.log('No search results found');
        return NextResponse.json({
          content:
            "I don't see any relevant messages in the chat history that would help me answer your question. Could you provide more context or rephrase your question?",
          citations: [],
          isValid: true,
          metadata: {
            totalTokens: 0,
            processingTime: 0,
            citationCount: 0,
            containsCode: false,
            containsLinks: false,
          },
        });
      }

      // Fetch full message data with user and channel info
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select(
          `
          id,
          content,
          created_at,
          user_id,
          channel_id,
          profiles:user_id(
            id,
            username,
            created_at
          ),
          channels:channel_id(
            id,
            name,
            description,
            is_private,
            is_direct_message,
            created_at,
            updated_at,
            created_by
          )
        `
        )
        .in(
          'id',
          searchResults.map((r) => r.messageId)
        )
        .order('created_at', { ascending: true })
        .returns<MessageWithRelations[]>();

      if (messagesError) {
        console.error('Error fetching messages:', messagesError);
        throw messagesError;
      }

      console.log('Fetched messages from Supabase:', messages?.length);

      // Format messages for context assembly
      const formattedMessages =
        messages?.map((msg) => ({
          id: msg.id,
          content: msg.content,
          username: msg.profiles?.username || 'Unknown User',
          timestamp: new Date(msg.created_at).toLocaleString(),
          channelName: msg.channels?.name || 'Unknown Channel',
          type: 'message' as const,
        })) || [];

      console.log('Formatted messages:', formattedMessages.length);

      // Format context for the prompt
      const context = formatContextForPrompt({
        messages: formattedMessages,
        truncated: false,
        totalTokens: 0,
      });

      console.log('Context assembled, message count:', formattedMessages.length);

      // Transform messages for response processing
      const processedMessages =
        messages?.map((msg) => ({
          id: msg.id,
          content: msg.content,
          createdAt: new Date(msg.created_at),
          user: {
            id: msg.profiles?.id,
            username: msg.profiles?.username || 'Unknown User',
            createdAt: new Date(msg.profiles?.created_at || msg.created_at),
          },
          channel: {
            id: msg.channels?.id,
            name: msg.channels?.name || 'Unknown Channel',
            description: msg.channels?.description || '',
            isPrivate: msg.channels?.is_private || false,
            isDirectMessage: msg.channels?.is_direct_message || false,
            createdAt: new Date(msg.channels?.created_at || msg.created_at),
            updatedAt: new Date(msg.channels?.updated_at || msg.created_at),
            createdBy: msg.channels?.created_by || msg.user_id,
          },
        })) || [];

      // Generate chat response
      const startTime = Date.now();
      const response = await generateChatResponse({
        systemMessage: {
          role: 'system',
          content: `You are an AI assistant in the ChatGenius workspace. Your primary task is to provide comprehensive responses based ONLY on the chat history provided below.

IMPORTANT INSTRUCTIONS:
1. ONLY reference information that is explicitly present in the chat history
2. NEVER make up or assume information not present in the messages
3. NEVER reference users or conversations that aren't in the provided context
4. After your main response, ALWAYS include a "Sources:" section
5. Under Sources, list EVERY message you referenced using [1], [2], etc.
6. Format each source citation EXACTLY as: [X] @username in #channel: <exact message content>
7. Make sure to cite ALL relevant messages that support your response
8. Keep citations in the Sources section only, not in the main response
9. Always include both the username (with @) and channel (with #) in each citation
10. If there is insufficient context to answer fully, explicitly state what information is missing

${context}`,
        },
        userMessage: query,
      });

      // Process and validate the response
      const processedResponse = processResponse(response, processedMessages, startTime);

      return NextResponse.json(processedResponse);
    } catch (searchError) {
      console.error('Error during semantic search:', searchError);
      throw searchError;
    }
  } catch (error) {
    console.error('AI chat error:', error);
    return NextResponse.json({ error: 'Failed to process AI chat request' }, { status: 500 });
  }
}
