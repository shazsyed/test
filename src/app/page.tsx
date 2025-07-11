"use client"

import CodeReviewChallenge from "@/components/code-review-challenge"
import UserCount from "@/components/ui/user-count"

export default function Page() {
  return (
    <>
      <div style={{ position: 'fixed', top: 16, left: 16, zIndex: 1000 }}>
        <UserCount />
      </div>
      <CodeReviewChallenge />
    </>
  )
}
