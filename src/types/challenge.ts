export interface Challenge {
  id: string
  title: string
  description: string
  code: string
  vulnerableLines: number[]
  difficulty: "beginner" | "intermediate" | "advanced"
  hints?: string[]
  explanations: { [lineNumber: number]: string }
  flag?: string
  labUrl?: string
  maxSelectableLines?: number // maximum number of lines user can select for this challenge
}

export type Difficulty = "beginner" | "intermediate" | "advanced"
