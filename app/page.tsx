export default function HomePage() {
  return (
    <main className="bg-neutral-900 text-white min-h-screen px-6 sm:px-12 py-16">
      <section className="max-w-6xl mx-auto text-center mb-20">
        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight uppercase mb-6">
          This Gear Powers Your Next Escape
        </h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-8">
          High-performance electric gear, rugged and designed for the edge of the map. 
          Modular. Adaptable. Voltique.
        </p>
        <button className="px-6 py-3 text-lg font-semibold border border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black transition rounded">
          Shop Featured Gear
        </button>
      </section>

      <section className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="bg-neutral-800 rounded-lg overflow-hidden shadow hover:shadow-lg transition"
          >
            <div className="aspect-video bg-neutral-700 flex items-center justify-center text-gray-500 text-xl">
              Image
            </div>
            <div className="p-4">
              <h3 className="text-xl font-semibold mb-2">Voltique Item #{item}</h3>
              <p className="text-gray-400 text-sm mb-4">
                Premium electric performance. Built for the extremes.
              </p>
              <button className="text-orange-500 hover:underline text-sm font-medium">
                Learn more →
              </button>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
