"use client";

import Link from "next/link";
import Image from "next/image";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="h-16"> </div>

      <div className="flex-1 flex flex-col items-center">
        <section className="w-full text-center mb-6">
          <h1 className="font-sans text-3xl font-semibold  mt-6 mb-2 text-black">
            Velkomin!
          </h1>
          <p className="text-xl text-black mx-auto leading-relaxed max-w-2xl px-4 mb-2">
            Skráðu þig inn til að spila skemmtilega leiki
          </p>
        </section>

        <div className="w-full max-w-7xl grid grid-cols-1 sm:grid-cols-2 gap-6 px-8 mb-36">

          {/* Orðla Game Card */}
          <Link href="/ordla" className="group">
            <article className="bg-white rounded-lg shadow-lg hover:shadow-2xl hover:scale-103 transition-all duration-300 overflow-hidden transform-gpu pb-2">
              <div className="aspect-[16/9] relative bg-gradient-to-br from-purple-500 to-indigo-600">
                <div className="absolute inset-0 flex items-center justify-center hover:scale-105 transition-transform duration-300">
                  <div className="w-1/2 h-1/2 relative">
                    <Image
                      src="/images/ordla.png"
                      alt="Orðla"
                      fill
                      style={{ objectFit: "contain" }}
                      priority
                      className="drop-shadow-lg"
                    />
                  </div>
                </div>
              </div>
              <div>
                <div className="flex flex-col items-center mb-2">
                  <div className="w-full flex items-center justify-between mb-3 relative">
                    <div className="flex-1 text-center">
                      <h2 className="text-xl font-bold text-gray-900 group-hover:text-purple-600 inline-block mt-2 hover:scale-105 transition-transform duration-300">
                        Orðla
                      </h2>
                    </div>
                    <span className="absolute -top-2 right-0 bg-green-100 text-green-800 px-4 py-1 rounded-full text-xs font-medium shadow-sm hover:scale-102">
                      Yfir 100 orð til að gíska á
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2 text-center w-full">
                    Finndu leyniorðið í 6 tilraunum eða færri. 
                  </p>
                </div>
              </div>
            </article>
          </Link>

          {/* Hengiman Game Card */}
          <div className="group relative">
            <Link href="#" onClick={(e) => e.preventDefault()} className="group cursor-not-allowed ">
              <article className="bg-white rounded-lg shadow-lg hover:shadow-2xl hover:scale-103 transition-all duration-300 overflow-hidden transform-gpu pb-2">
                <div className="aspect-[16/9] relative bg-gradient-to-br from-blue-500 to-cyan-600">
                  <div className="absolute inset-0 flex items-center justify-center hover:scale-105 transition-transform duration-300 backdrop-blur-sm blur-xs">
                    <div className="w-1/2 h-1/2 relative">
                      <Image
                        src="/images/hengiman.png"
                        alt="Hangman"
                        fill
                        style={{ objectFit: "contain" }}
                        priority
                        className="drop-shadow-lg"
                      />
                    </div>
                  </div>
                  {/* Coming Soon Text */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-10 py-3 rounded-full text-xl font-bold transform rotate-[-15deg] shadow-lg border-2 border-white/30">
                      Kemur fljótlega
                    </span>
                  </div>
                </div>
                <div>
                  <div className="flex flex-col items-center mb-2">
                    <div className="w-full flex items-center justify-between mb-3 relative">
                      <div className="flex-1 text-center">
                        <h2 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 inline-block mt-2 hover:scale-105 transition-transform duration-300">
                          Hengiman
                        </h2>
                      </div>
                      <span className="absolute -top-2 right-0 bg-blue-100 text-blue-800 px-4 py-1 rounded-full text-xs font-medium shadow-sm">
                        Kemur fljótlega
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2 text-center w-full">
                      Klassískur hengiman.
                    </p>
                  </div>
                </div>
              </article>
            </Link>
          </div>
        </div>
      </div>

      <footer className="w-full bg-white border-t border-gray-200 mt-10">
        {/* Footer content */}
      </footer>
    </div>
  );
}
