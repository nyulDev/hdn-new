import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { Logo } from '@/assets/logo'

type AuthLayoutProps = {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const pageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const context = gsap.context(() => {
      const mediaQuery = gsap.matchMedia()

      mediaQuery.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('[data-auth-brand]', {
          duration: 0.8,
          ease: 'power3.out',
          opacity: 0,
          x: -36,
        })
        gsap.from('[data-auth-panel]', {
          delay: 0.12,
          duration: 0.8,
          ease: 'power3.out',
          opacity: 0,
          x: 36,
        })
        gsap.from('[data-auth-stagger]', {
          delay: 0.28,
          duration: 0.55,
          ease: 'power2.out',
          opacity: 0,
          stagger: 0.07,
          y: 18,
        })
        gsap.to('[data-auth-orbit]', {
          duration: 16,
          ease: 'none',
          repeat: -1,
          rotation: 360,
        })
      })

      return () => mediaQuery.revert()
    }, pageRef)

    return () => context.revert()
  }, [])

  return (
    <div
      ref={pageRef}
      className='relative min-h-svh overflow-hidden bg-[#edf3f0] text-slate-950 dark:bg-[#101b24] dark:text-white'
    >
      <div
        data-auth-orbit
        className='pointer-events-none absolute -end-32 -top-32 size-96 rounded-full border border-red-500/20'
      />
      <div className='pointer-events-none absolute -start-32 -bottom-44 size-96 rounded-full border border-emerald-500/20' />

      <div className='relative mx-auto grid min-h-svh max-w-7xl items-center gap-6 px-4 py-4 sm:px-6 lg:grid-cols-[1.08fr_minmax(400px,0.92fr)] lg:gap-10 lg:px-10'>
        <section
          data-auth-brand
          className='relative hidden min-h-[620px] overflow-hidden rounded-[2rem] bg-[#073b70] p-8 text-white shadow-2xl shadow-slate-900/15 lg:flex lg:flex-col lg:justify-between lg:p-12'
        >
          <div className='absolute -end-24 top-24 size-72 rounded-full border-[38px] border-red-500/80' />
          <div className='absolute -start-20 -bottom-36 size-80 rounded-full border-[34px] border-emerald-400/25' />
          <div className='relative z-10 flex items-center gap-3 text-sm font-semibold tracking-[0.18em] uppercase'>
            <span className='flex size-10 items-center justify-center rounded-xl bg-white text-[#073b70]'>
              <Logo className='size-6' />
            </span>
            HDN workspace
          </div>

          <div className='relative z-10 max-w-lg'>
            <div className='mb-8 inline-flex rounded-2xl bg-white p-4 shadow-xl shadow-slate-950/10'>
              <img
                src='/images/logo.png'
                alt='PT Haluan Daya Niaga'
                className='h-auto w-72 object-contain'
              />
            </div>
            <p className='mb-4 text-sm font-semibold tracking-[0.2em] text-emerald-300 uppercase'>
              Operations portal
            </p>
            <h1 className='max-w-md text-4xl leading-[1.05] font-semibold tracking-tight xl:text-5xl'>
              Keep every commercial move in motion.
            </h1>
            <p className='mt-5 max-w-md text-base leading-7 text-blue-100'>
              Kelola quotation, invoice, estimasi, profit, dan tanda terima
              barang dari satu ruang kerja yang rapi.
            </p>
          </div>

          <div className='relative z-10 flex items-center justify-between border-t border-white/15 pt-5 text-xs text-blue-100'>
            <span>Haluan Daya Niaga</span>
            <span className='font-mono tracking-widest'>01 / 04</span>
          </div>
        </section>

        <section
          data-auth-panel
          className='mx-auto flex w-full max-w-xl flex-col rounded-[2rem] border border-white/70 bg-white/90 p-5 shadow-2xl shadow-slate-900/10 backdrop-blur sm:p-9 dark:border-white/10 dark:bg-slate-950/80'
        >
          <div className='mb-8 flex items-center gap-3'>
            <span className='flex size-11 items-center justify-center rounded-2xl bg-[#073b70] text-white shadow-lg shadow-blue-900/15'>
              <Logo className='size-6' />
            </span>
            <div>
              <p className='text-xs font-bold tracking-[0.18em] text-[#073b70] uppercase dark:text-emerald-300'>
                HDN workspace
              </p>
              <p className='text-sm text-slate-500 dark:text-slate-400'>
                Secure sign in
              </p>
            </div>
          </div>
          {children}
        </section>
      </div>
    </div>
  )
}
