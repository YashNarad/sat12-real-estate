export type ListingIntent = "Buy" | "Rent";
export type PropertyType = "Apartment" | "Villa" | "Independent House" | "Plot";
export type PropertyStatus = "Ready to Move" | "Under Construction";

export interface PropertyImage {
  src: string;
  alt: string;
  license: "SAT12 placeholder";
}

export interface Property {
  id: string;
  title: string;
  listingIntent: ListingIntent;
  propertyType: PropertyType;
  price: number;
  locality: string;
  city: "Nagpur";
  latitude: number;
  longitude: number;
  image: PropertyImage;
  bedrooms: number;
  bathrooms: number;
  areaSqFt: number;
  status: PropertyStatus;
  reraApproved: boolean;
  badge?: "Featured" | "New";
}

export interface PropertyFiltersState {
  query: string;
  intent: ListingIntent;
  propertyType: PropertyType | "All";
  maxPrice: number | null;
  bedrooms: number | null;
}
