export default function LoadingSpinner({ size = 6 }: { size?: number }) {
  return (
    <div className="flex justify-center py-8">
      <div
        className={`w-${size} h-${size} border-2 border-brand-500 border-t-transparent rounded-full animate-spin`}
      />
    </div>
  )
}
