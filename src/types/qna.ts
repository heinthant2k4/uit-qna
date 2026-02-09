export type FeedSort = 'latest' | 'top';
export type QuestionCategory = 'academic' | 'facilities' | 'policy';

export interface UserSummary {
  anon_handle: string;
  color_seed: number;
}

export interface Question {
  id: string;
  public_id: string;
  title: string;
  body: string;
  category: QuestionCategory;
  image_urls: string[];
  tags: string[];
  score: number;
  answer_count: number;
  created_at: string;
  updated_at: string | null;
  author: UserSummary;
  /** true when the current user is the author (only set in profile context) */
  is_own?: boolean;
}

export interface Answer {
  id: string;
  body: string;
  image_urls: string[];
  score: number;
  is_best: boolean;
  is_verified: boolean;
  verified_count?: number;
  created_at: string;
  updated_at: string | null;
  author: UserSummary;
  replies: Reply[];
  /** true when the current user is the author (only set in profile context) */
  is_own?: boolean;
  /** the question this answer belongs to (only set in profile context) */
  question_ref?: { id: string; public_id: string; title: string };
}

export interface Reply {
  id: string;
  body: string;
  created_at: string;
  updated_at: string | null;
  author: UserSummary;
}

export interface UserProfile {
  anon_handle: string;
  color_seed: number;
  joined_at: string;
  question_count: number;
  answer_count: number;
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
