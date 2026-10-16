export interface ChildItem {
  src: string;
  title: string;
  description?: string;
}

export interface MediaItem {
  id: number;
  src: string;
  title: string;
  description?: string;
  children: string | ChildItem[];
  updated_at?: string;
  updated_by?: string;
}
