export default function middleware(request: Request) {
  const auth = request.headers.get('authorization')

  const USERNAME = 'admin'
  const PASSWORD = process.env.SITE_PASSWORD

  if (auth) {
    const [, encoded] = auth.split(' ')
    const decoded = atob(encoded)
    const [user, pwd] = decoded.split(':')

    if (user === USERNAME && pwd === PASSWORD) {
      return
    }
  }

  return new Response('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Secure Area"' },
  })
}

export const config = {
  matcher: '/((?!_next/static|favicon.ico).*)',
}
