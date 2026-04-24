// Sample photo library — a mix of recent and vintage-feeling shots for both Swipe and Memory game.

export type SamplePhoto = {
  id: string;
  url: string;
  thumb: string;
  title: string;
  year: number;
  month: string;
  device: string;
  sizeMB: number;
  hasGPS: boolean;
};

const PIC = (seed: string, w = 800, h = 1100) =>
  `https://picsum.photos/seed/${seed}/${w}/${h}`;

export const SAMPLE_PHOTOS: SamplePhoto[] = [
  { id: "p1",  url: PIC("alps-dawn"),       thumb: PIC("alps-dawn",400,500),       title: "Alpine Dawn",       year: 2023, month: "Aug", device: "iPhone 14 Pro", sizeMB: 4.2, hasGPS: true  },
  { id: "p2",  url: PIC("city-rain"),       thumb: PIC("city-rain",400,500),       title: "City Rain",         year: 2022, month: "Nov", device: "iPhone 13",    sizeMB: 3.1, hasGPS: true  },
  { id: "p3",  url: PIC("desert-road"),     thumb: PIC("desert-road",400,500),     title: "Desert Road",       year: 2021, month: "Jun", device: "iPhone 12",    sizeMB: 2.8, hasGPS: false },
  { id: "p4",  url: PIC("coffee-shop"),     thumb: PIC("coffee-shop",400,500),     title: "Coffee Shop",       year: 2024, month: "Feb", device: "iPhone 15",    sizeMB: 5.4, hasGPS: true  },
  { id: "p5",  url: PIC("forest-fog"),      thumb: PIC("forest-fog",400,500),      title: "Forest Fog",        year: 2020, month: "Oct", device: "iPhone 11",    sizeMB: 2.2, hasGPS: false },
  { id: "p6",  url: PIC("ocean-cliff"),     thumb: PIC("ocean-cliff",400,500),     title: "Ocean Cliff",       year: 2019, month: "Jul", device: "iPhone XS",    sizeMB: 1.9, hasGPS: true  },
  { id: "p7",  url: PIC("street-market"),   thumb: PIC("street-market",400,500),   title: "Street Market",     year: 2018, month: "Sep", device: "iPhone X",     sizeMB: 1.6, hasGPS: true  },
  { id: "p8",  url: PIC("snow-cabin"),      thumb: PIC("snow-cabin",400,500),      title: "Snow Cabin",        year: 2017, month: "Dec", device: "iPhone 7",     sizeMB: 1.4, hasGPS: false },
  { id: "p9",  url: PIC("retro-car"),       thumb: PIC("retro-car",400,500),       title: "Retro Car",         year: 2015, month: "May", device: "iPhone 6s",    sizeMB: 1.1, hasGPS: true  },
  { id: "p10", url: PIC("old-polaroid"),    thumb: PIC("old-polaroid",400,500),    title: "Polaroid Day",      year: 2013, month: "Mar", device: "iPhone 5",     sizeMB: 0.8, hasGPS: false },
  { id: "p11", url: PIC("garden-bench"),    thumb: PIC("garden-bench",400,500),    title: "Garden Bench",      year: 2024, month: "Apr", device: "iPhone 15 Pro",sizeMB: 6.1, hasGPS: true  },
  { id: "p12", url: PIC("late-night"),      thumb: PIC("late-night",400,500),      title: "Late Night",        year: 2016, month: "Aug", device: "iPhone 6",     sizeMB: 1.2, hasGPS: true  },
];

export const MEMORY_POOL: SamplePhoto[] = SAMPLE_PHOTOS.filter((p) => p.year <= 2020);
