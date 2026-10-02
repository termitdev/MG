import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { About } from "@/components/landing/About";
import { Exam } from "@/components/landing/Exam";
import { Process } from "@/components/landing/Process";
import { Differentials } from "@/components/landing/Differentials";
import { Faq } from "@/components/landing/Faq";
import { Cta } from "@/components/landing/Cta";
import { Footer } from "@/components/landing/Footer";

const title = "MUGUI — Exame Toxicológico com precisão e atendimento humano";
const description = "Clínica MUGUI: exame toxicológico com segurança, agilidade e rigor laboratorial. Agende seu exame.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <About />
        <Exam />
        <Process />
        <Differentials />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
