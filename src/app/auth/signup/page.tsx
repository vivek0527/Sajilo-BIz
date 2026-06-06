'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useUIStore } from '@/lib/store';
import { dbClient } from '@/lib/db';
import { Store, Mail, Lock, Loader2, ArrowRight } from 'lucide-react';

const signupSchema = z.object({
  shopName: z.string().min(2, 'Shop name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(6, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignupForm = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const { setUser } = useUIStore();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupForm) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { user, error } = await dbClient.auth.signUp(data.email, data.password, data.shopName);
      if (error) throw error;
      if (user) {
        setUser(user);
        router.push('/dashboard');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to register account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-12 sm:px-6 lg:px-8">
      {/* Decorative background blobs */}
      <div className="absolute top-1/4 left-1/4 -z-10 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 -z-10 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl" />

      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex items-center justify-center">
            <img
              src="/logo.png"
              alt="Saral Biz"
              className="h-12 w-auto object-contain dark:brightness-110"
            />
          </div>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
            Create an account
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Get started with Saral Biz shop manager.
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-8 shadow-xl">
          {errorMsg && (
            <div className="mb-6 rounded-xl bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
              {errorMsg}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-2">
              <label htmlFor="shopName" className="text-sm font-medium text-foreground">
                Shop Name
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                  <Store size={18} />
                </div>
                <input
                  id="shopName"
                  type="text"
                  placeholder="Super Grocery Mart"
                  {...register('shopName')}
                  className={`block w-full rounded-xl border bg-background/50 pl-10 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary ${errors.shopName ? 'border-destructive' : 'border-border'
                    }`}
                />
              </div>
              {errors.shopName && (
                <p className="text-xs text-destructive">{errors.shopName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                Email address
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                  <Mail size={18} />
                </div>
                <input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  {...register('email')}
                  className={`block w-full rounded-xl border bg-background/50 pl-10 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary ${errors.email ? 'border-destructive' : 'border-border'
                    }`}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                  <Lock size={18} />
                </div>
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  {...register('password')}
                  className={`block w-full rounded-xl border bg-background/50 pl-10 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary ${errors.password ? 'border-destructive' : 'border-border'
                    }`}
                />
              </div>
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
                Confirm Password
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                  <Lock size={18} />
                </div>
                <input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  {...register('confirmPassword')}
                  className={`block w-full rounded-xl border bg-background/50 pl-10 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary ${errors.confirmPassword ? 'border-destructive' : 'border-border'
                    }`}
                />
              </div>
              {errors.confirmPassword && (
                <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/95 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 transition-all"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <>
                  Register <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <span className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link href="/auth/login" className="font-semibold text-primary hover:underline">
                Sign in
              </Link>
            </span>
          </div>
        </div>

        {/* Orbya Tech Co-branding */}
        <div className="flex flex-col items-center justify-center pt-2">
          <span className="text-[10px] text-muted-foreground mb-2 uppercase tracking-widest font-semibold">Developed By</span>
          <a
            href="https://orbyatech.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-transparent py-1 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <img
              src="/orbya-light.png"
              alt="Orbya Tech"
              className="h-8 w-auto object-contain dark:hidden block"
            />
            <img
              src="/orbya-dark.png"
              alt="Orbya Tech"
              className="h-8 w-auto object-contain hidden dark:block"
            />
          </a>
        </div>
      </div>
    </div>
  );
}
