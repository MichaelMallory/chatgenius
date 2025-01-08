'use client'

export default function ChannelsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto p-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">ChatGenius</h1>
        </div>
      </header>
      <main>
        {children}
      </main>
    </div>
  )
} 