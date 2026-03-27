import './App.css'
import Nav from './components/Nav'
import Hero from './components/Hero'
import Services from './components/Services'
import Works from './components/Works'
import Strengths from './components/Strengths'
import Process from './components/Process'
import Message from './components/Message'
import About from './components/About'
import Contact from './components/Contact'

function App() {
  return (
    <>
      <Nav />
      <Hero />
      <Services />
      <Works />
      <Strengths />
      <Process />
      <Message />
      <About />
      <Contact />
      <footer className="footer">
        <p>&copy; 2026 株式会社サンプル All Rights Reserved.</p>
      </footer>
    </>
  )
}

export default App
