export default function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">
      {message}
    </div>
  )
}
