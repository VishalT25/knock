export const metadata = { title: "Offline" };
export default function Offline() {
  return (
    <main className="screen" style={{ minHeight: "100dvh", justifyContent: "center", textAlign: "center" }}>
      <h1 className="t-title" style={{ fontSize: "2rem" }}>No connection</h1>
      <p className="t-muted">Knock needs the internet to open the door. Check your Wi-Fi or mobile data, then reload.</p>
      <p><a className="btn btn-primary" href="/">Try again</a></p>
    </main>
  );
}
