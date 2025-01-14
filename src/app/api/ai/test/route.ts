import { OpenAI } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import { Pinecone } from '@pinecone-database/pinecone';
import { env } from '@/lib/env';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Initialize OpenAI
    const openai = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });

    // Initialize Pinecone
    const pc = new Pinecone({
      apiKey: env.PINECONE_API_KEY!,
    });

    // Get the index
    const index = pc.index(env.PINECONE_INDEX!);

    return NextResponse.json({ status: 'ok', message: 'AI services initialized successfully' });
  } catch (error) {
    console.error('Error initializing AI services:', error);
    return NextResponse.json(
      { status: 'error', message: 'Failed to initialize AI services' },
      { status: 500 }
    );
  }
}
