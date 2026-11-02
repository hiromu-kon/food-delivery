import { Spinner } from '@/components/ui/spinner';
export default function Loading() {
  return (
    <div role="status" className="flex flex-1 items-center justify-center gap-3 p-8">
      <Spinner aria-hidden />
      読み込んでいます
    </div>
  );
}
