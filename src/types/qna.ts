export type FeedSort = 'latest' | 'top';
export type QuestionCategory = 'academic' | 'facilities' | 'policy';

export interface UserSummary {
  anon_handle: string;
  color_seed: number;
}

export interface Question {
  id: string;
  title: string;
  body: string;
  category: QuestionCategory;
  image_urls: string[];
  tags: string[];
  score: number;
  answer_count: number;
  created_at: string;
  author: UserSummary;
}

export interface Answer {
  id: string;
  body: string;
  image_urls: string[];
  score: number;
  is_best: boolean;
  created_at: string;
  author: UserSummary;
}

export interface QuestionDetail {
  question: Question;
  best_answer: Answer | null;
  other_answers: Answer[];
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
  has_next: boolean;
}
