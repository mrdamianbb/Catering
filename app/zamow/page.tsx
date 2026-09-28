import type { Metadata } from "next";
import Store from "../sklep/page";

export const metadata: Metadata = {
  title: "Zamów dietę | Dzika Kaczka Catering",
  description:
    "Zamów catering dietetyczny w Jastrzębiu-Zdroju, Wodzisławiu, Rybniku i Żorach. Sześć diet, jedenaście kaloryczności, dowóz pod drzwi siedem dni w tygodniu.",
  alternates: { canonical: "/zamow" }
};

/** Ten sam formularz co na stronie głównej, pod własnym adresem. */
export default function ZamowPage() {
  return <Store tylkoFormularz />;
}
