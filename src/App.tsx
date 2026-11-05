import './App.css'

function App() {
  return (
    <main className="setup-screen">
      <p className="eyebrow">PERSONAL FINANCE</p>
      <h1>A clearer view of your money.</h1>
      <p className="intro">The React and TypeScript foundation is ready. Choose a visual direction and we can shape the dashboard around it.</p>
      <div className="setup-card">
        <span className="setup-mark" aria-hidden="true">£</span>
        <div><strong>Next up: your dashboard</strong><p>Transactions, categories, and date range summaries.</p></div>
      </div>
    </main>
  )
}

export default App
