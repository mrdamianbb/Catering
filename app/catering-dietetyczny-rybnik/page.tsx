import type { Metadata } from "next";
import { CityPage } from "@/components/CityPage";
import { CITIES } from "@/lib/cities";

const city = CITIES[2];

export const metadata: Metadata = {
  title: city.title,
  description: city.description,
  alternates: { canonical: `/${city.slug}` }
};

export default function Page() {
  return <CityPage city={city} />;
}
