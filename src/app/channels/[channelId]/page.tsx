import { ChannelContent } from '@/app/channels/[channelId]/channel-content';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { Metadata } from 'next';

interface PageParams {
  channelId: string;
}

interface SearchParams {
  [key: string]: string | string[] | undefined;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const resolvedParams = await params;
  return {
    title: `Channel ${resolvedParams.channelId}`,
  };
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<PageParams>;
  searchParams?: Promise<SearchParams>;
}) {
  const [resolvedParams, resolvedSearchParams] = await Promise.all(
    [params, searchParams].filter(Boolean) as Promise<any>[]
  );

  const channelId = resolvedParams.channelId;

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      }
    >
      <ChannelContent channelId={channelId} />
    </Suspense>
  );
}
