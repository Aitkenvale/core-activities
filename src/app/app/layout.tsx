import { SwipeBack } from "@/components/SwipeBack";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SwipeBack />
      {children}
    </>
  );
}
