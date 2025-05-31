import { AuthProvider } from '@/contexts/AuthContext';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="bg-gray-50 flex flex-col items-center justify-center px-6 py-8">
      <div className="w-full bg-white rounded-lg shadow dark:border sm:max-w-2xl xl:p-0">
        <div className="p-6 space-y-4 sm:p-8">
          <AuthProvider>
            {children}
          </AuthProvider>
        </div>
      </div>
    </section>
  );
}
