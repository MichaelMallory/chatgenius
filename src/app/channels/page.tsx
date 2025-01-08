import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function ChannelsPage() {
  return (
    <div className="container mx-auto p-8">
      <Card>
        <CardHeader>
          <CardTitle>Welcome to ChatGenius</CardTitle>
        </CardHeader>
        <CardContent>
          <p>This is a test page for the messaging portion of the application.</p>
          <p className="mt-4">Future features will include:</p>
          <ul className="list-disc ml-6 mt-2">
            <li>Real-time messaging</li>
            <li>Channel management</li>
            <li>Direct messages</li>
            <li>File sharing</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
} 