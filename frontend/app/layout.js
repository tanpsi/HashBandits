import "./globals.css";
import { Web3Provider } from "./context/Web3Context";
import LiquidEther from "./components/LiquidEther";

export const metadata = {
  title: "DAO Governance | Decentralized Autonomous Organization",
  description:
    "A modern DAO governance platform. Create proposals, vote on-chain, and shape the future of decentralized decision-making.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <LiquidEther 
          colors={['#0047FF', '#00D1FF', '#A3E6FF']} 
          style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 0, pointerEvents: 'none' }}
        />
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}
