import { UserInputForm } from "@/components/user-input-form"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-24">
      <div className="w-full max-w-md">
        <h1 className="mb-6 text-3xl font-bold text-center">Sleeper Roster Tracker </h1>
        <p className="mb-8 text-center text-muted-foreground">
          Track how you built your fantasy football roster
        </p>
        <UserInputForm />
      </div>
    </main>
  )
}
