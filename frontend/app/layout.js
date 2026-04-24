import "./globals.css";
import { Web3Provider } from "./context/Web3Context";

export const metadata = {
  title: "DAO Governance | Decentralized Autonomous Organization",
  description:
    "A modern DAO governance platform. Create proposals, vote on-chain, and shape the future of decentralized decision-making.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}
