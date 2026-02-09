export default function Home() {
  return (
    <div className="flex flex-col w-dvw items-center">
      <div className="max-w-120 flex flex-col gap-8 py-18">
        <div className="">
          <div className="font-sans">whoami.wiki</div>
          <div className="font-sans text-neutral-500 dark:text-neutral-400">
            your personal encyclopedia, written by agents
          </div>
        </div>

        <div className="h-px w-full bg-neutral-200 dark:bg-neutral-700" />

        <div className="font-sans">
          You have years of digital life sitting in folders. Photos from trips
          you've half-forgotten. Chat logs with inside jokes and turning points.
          Documents that trace how your thinking evolved. Location history that
          maps where you've actually spent your time.
        </div>

        <div className="font-sans">
          The whoami.wiki system turns your digital archives of photos, chats,
          documents, location history, and different types of data into a living
          encyclopedia about your life.
        </div>
      </div>

      <div className="h-dvh w-dvw bg-blue-200 dark:bg-blue-800 p-8 flex flex-col items-end">
        <div className="flex flex-col gap-2 max-w-16 items-center">
          <div>
            <div className="h-1 w-5 bg-blue-400 rounded-md rounded-b-none" />
            <div className="w-11 h-8 bg-blue-400 rounded-sm rounded-tl-none" />
          </div>
          <div className="font-sans text-xs wrap-break-word text-white text-shadow-lg text-center">
            Coorg Trip 2013
          </div>
        </div>
      </div>
    </div>
  );
}
