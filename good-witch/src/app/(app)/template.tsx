// Re-mounts on every navigation, giving each screen a soft rise-in transition.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-rise">{children}</div>;
}
