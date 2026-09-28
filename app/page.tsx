import StorePage from "./sklep/page";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Korzeń zawsze pokazuje sklep — niezależnie od domeny, adresu podglądowego
// czy aliasu. Panel obsługi jest pod /panel i chroniony logowaniem Supabase.
export default function HomePage() {
  return <StorePage />;
}
