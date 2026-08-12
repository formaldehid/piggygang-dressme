import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { COLLECTIONS, getReadyCollection } from "@/lib/collections";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ConnectButton } from "@/components/wallet/connect-button";
import { WardrobeEditor } from "@/components/wardrobe/wardrobe-editor";

export function generateStaticParams() {
  return COLLECTIONS.filter((collection) => collection.status === "ready").map((collection) => ({
    collection: collection.slug,
  }));
}

export async function generateMetadata(
  props: PageProps<"/dress/[collection]">,
): Promise<Metadata> {
  const { collection: slug } = await props.params;
  const collection = getReadyCollection(slug);
  if (!collection) return {};

  return { title: collection.name, description: collection.tagline };
}

export default async function DressPage(props: PageProps<"/dress/[collection]">) {
  const { collection: slug } = await props.params;
  const collection = getReadyCollection(slug);
  if (!collection) notFound();

  return (
    <>
      <SiteHeader>
        <ConnectButton />
      </SiteHeader>
      <main className="flex-1">
        <WardrobeEditor collection={collection} />
      </main>
      <SiteFooter />
    </>
  );
}
