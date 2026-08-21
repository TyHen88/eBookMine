import Reader from "@/components/Reader";

export default async function ReadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ page?: string; title?: string }>;
}) {
  const { id } = await params;
  const sParams = searchParams ? await searchParams : undefined;
  const pageNum = sParams?.page ? parseInt(sParams.page, 10) : undefined;
  const initialPage = pageNum && !Number.isNaN(pageNum) && pageNum > 0 ? pageNum : undefined;
  const initialTitle = sParams?.title ? decodeURIComponent(sParams.title) : undefined;

  return <Reader id={id} initialPage={initialPage} initialTitle={initialTitle} />;
}
