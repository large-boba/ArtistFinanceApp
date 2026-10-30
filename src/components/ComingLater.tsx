// A small reusable piece of screen (a "component"): the heading and the
// "coming later" note shared by the screens that are still empty.
// It has no "use client", so it's a server component and runs only on the server.

export default function ComingLater({
  title,
  stage,
  children,
}: {
  title: string;
  stage: number;
  children: React.ReactNode;
}) {
  return (
    <>
      <h1 className="text-2xl font-bold break-words">{title}</h1>
      <p className="mt-4 text-base text-zinc-700 dark:text-zinc-300">
        {children}
      </p>
      <p className="mt-2 text-base font-medium">Coming in Stage {stage}.</p>
    </>
  );
}
