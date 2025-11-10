import Link from "next/link"

const Page = () => {
  return (
    <div className="h-screen w-screen flex items-center justify-center gap-2">
      <Link href = "/delta-hedger" className="p-4 bg-black text-white rounded-2 border-2">Delta-hedger</Link>
      <Link href = "/premium-hedger" className="p-4 bg-black text-white rounded-2 border-2">premium-hedger</Link>
    </div>
  )
}

export default Page