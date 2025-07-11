"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

function AdminModal({ open, onSubmit, error }: { open: boolean, onSubmit: (password: string) => void, error?: string }) {
  const [input, setInput] = useState("");
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-xs flex flex-col items-center gap-4 relative">
        <h2 className="text-xl font-bold mb-2">Admin Login</h2>
        <p className="text-gray-600 text-sm mb-2">Enter admin password:</p>
        <input
          className="border rounded px-3 py-2 w-full focus:outline-none focus:ring"
          placeholder="Password"
          type="password"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && input.trim()) onSubmit(input.trim()); }}
        />
        {error && <div className="text-red-600 text-xs">{error}</div>}
        <div className="flex gap-2 w-full">
          <Button className="w-full mt-2" onClick={() => input.trim() && onSubmit(input.trim())}>Login</Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const res = await fetch('/api/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
      credentials: 'include',
    })
    const data = await res.json()
    if (data.success) {
      router.replace('/admin/dashboard')
    } else {
      setError(data.error || 'Login failed')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={handleLogin} className="bg-white p-8 rounded shadow w-full max-w-xs flex flex-col gap-4">
        <h2 className="text-xl font-bold">Admin Login</h2>
        <input
          type="password"
          className="border rounded px-3 py-2 w-full"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <button type="submit" className="bg-blue-600 text-white rounded px-4 py-2 font-semibold">Login</button>
      </form>
    </div>
  )
} 