import { type Message } from '@/types/message';
import { type User } from '@/types/user';
import { type Channel } from '@/types/channel';

export interface PromptContext {
  messages: Message[];
  currentUser: User;
  channel: Channel;
  truncated?: boolean;
}

export interface SystemMessageTemplate {
  role: 'system';
  content: string;
}

export interface PromptTemplate {
  systemMessage: SystemMessageTemplate;
  userMessage: string;
  assistantMessage?: string;
}

// Base system message that defines the AI avatar's core behavior
const BASE_SYSTEM_TEMPLATE = `You are an AI avatar representing {username} in the ChatGenius workspace. You should:
1. Mirror {username}'s communication style and personality based on their chat history
2. Maintain professional and appropriate workplace communication
3. Provide helpful and accurate responses informed by the conversation context
4. Be clear when you're referencing or citing previous messages
5. Respect channel topics and conversation themes

Current channel: #{channelName} - {channelDescription}`;

// Template for when responding to questions
const QUESTION_RESPONSE_TEMPLATE = `Based on the conversation history and context, help answer this question as {username} would.
Be sure to:
1. Reference relevant past messages when applicable
2. Maintain {username}'s typical response style
3. Keep responses focused and professional
4. Cite sources from the chat history when relevant`;

// Template for generating new messages
const MESSAGE_GENERATION_TEMPLATE = `Generate a message as {username} that contributes to the current conversation.
The message should:
1. Be relevant to the channel topic and current discussion
2. Match {username}'s communication style
3. Add value to the conversation
4. Maintain appropriate professional tone`;

export function createSystemMessage(
  username: string,
  channelName: string,
  channelDescription: string
): SystemMessageTemplate {
  return {
    role: 'system',
    content: BASE_SYSTEM_TEMPLATE.replace('{username}', username)
      .replace('{channelName}', channelName)
      .replace('{channelDescription}', channelDescription),
  };
}

export function createQuestionPrompt(context: PromptContext): PromptTemplate {
  const { currentUser, channel, messages } = context;

  return {
    systemMessage: createSystemMessage(currentUser.username, channel.name, channel.description),
    userMessage: QUESTION_RESPONSE_TEMPLATE.replace('{username}', currentUser.username),
    assistantMessage: formatContextMessages(messages, context.truncated),
  };
}

export function createMessageGenerationPrompt(context: PromptContext): PromptTemplate {
  const { currentUser, channel, messages } = context;

  return {
    systemMessage: createSystemMessage(currentUser.username, channel.name, channel.description),
    userMessage: MESSAGE_GENERATION_TEMPLATE.replace('{username}', currentUser.username),
    assistantMessage: formatContextMessages(messages, context.truncated),
  };
}

function formatContextMessages(messages: Message[], truncated?: boolean): string {
  if (messages.length === 0) {
    return 'No relevant context available.';
  }

  const formattedMessages = messages
    .map((msg) => `[${msg.user.username}]: ${msg.content}`)
    .join('\n\n');

  return `Here is the relevant conversation context${
    truncated ? ' (truncated)' : ''
  }:\n\n${formattedMessages}`;
}
