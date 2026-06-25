import Placeholder from './Placeholder';

export default function AppPreview() {
  return (
    // constrained width matches typical phone-like mockup
    <div className="w-full max-w-sm">
      {/* fixed height keeps layout consistent before real image loads */}
      <Placeholder label="App screenshot" className="w-full h-72 rounded-xl" />
    </div>
  );
}
