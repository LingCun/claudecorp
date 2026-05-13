import { signInWithGoogle } from '../firebase/auth'

export function LoginScreen() {
  const handleLogin = async () => {
    try {
      await signInWithGoogle()
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        console.error('로그인 실패:', err)
        alert('로그인 실패: ' + code)
      }
    }
  }

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-corp-bg">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,oklch(0.27_0.05_280)_0%,oklch(0.18_0.02_250)_50%,oklch(0.12_0.02_250)_100%)]" />

      <div className="relative max-w-md w-[90%] p-12 rounded-2xl bg-corp-bg2/70 backdrop-blur-xl border border-corp-border shadow-2xl text-center">
        <div className="text-6xl mb-2 bg-gradient-to-br from-corp-accent to-corp-accent2 bg-clip-text text-transparent">
          ✦
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">ClaudeCorp</h1>
        <p className="text-sm text-corp-muted mb-8 leading-relaxed">
          AI 직원과 함께하는 가상 회사.<br />
          당신은 회장. 채용하고, 지시하고, 성장시키세요.
        </p>

        <button
          onClick={handleLogin}
          className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-lg bg-white text-gray-900 hover:bg-gray-100 hover:-translate-y-px active:translate-y-0 transition font-medium text-sm shadow-lg"
        >
          <svg viewBox="0 0 48 48" className="w-5 h-5">
            <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
            <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
            <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
            <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
          </svg>
          Google로 계속하기
        </button>

        <div className="mt-8 text-xs text-corp-muted">
          로그인하면 회사가 자동으로 생성됩니다.
        </div>
      </div>
    </div>
  )
}
