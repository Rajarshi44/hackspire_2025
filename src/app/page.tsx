import { LoginButton } from "@/components/login-button";
import { LogoIcon } from "@/components/logo";

export default function Home() {
  return (
    <div className="relative w-full bg-neutral-950">
      <div className="absolute top-0 z-[0] h-full w-full bg-neutral-900/10 bg-[radial-gradient(ellipse_20%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]"></div>
      <section className="relative z-1 mx-auto max-w-full">
        <div className="pointer-events-none absolute h-full w-full overflow-hidden opacity-50 [perspective:200px]">
          <div className="absolute inset-0 [transform:rotateX(35deg)]">
            <div className="animate-grid [inset:0%_0px] [margin-left:-50%] [height:300vh] [width:600vw] [transform-origin:100%_0_0] [background-image:linear-gradient(to_right,rgba(255,255,255,0.25)_1px,transparent_0),linear-gradient(to_bottom,rgba(255,255,255,0.2)_1px,transparent_0)] [background-size:120px_120px] [background-repeat:repeat]"></div>
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent to-90%"></div>
        </div>

        <div className="z-10 mx-auto max-w-screen-xl gap-12 px-4 py-28 text-gray-600 md:px-8">
          <div className="mx-auto max-w-3xl space-y-5 text-center leading-0 lg:leading-5">
            <h1 className="font-geist group mx-auto w-fit rounded-3xl border-[2px] border-white/5 bg-gradient-to-tr from-purple-500 via-pink-500 to-orange-500 px-8 py-4 text-3xl md:text-5xl text-white">
              Welcome to GitPulse
            </h1>

            <h2 className="font-geist mx-auto bg-[linear-gradient(180deg,_#FFF_0%,_rgba(255,_255,_255,_0.00)_202.08%)] bg-clip-text text-4xl tracking-tighter text-transparent md:text-4xl">
              Your AI teammate that listens to developer chat and turns ideas into{" "}
              <span className="bg-gradient-to-r from-purple-300 to-orange-200 bg-clip-text text-transparent">
                actionable GitHub issues.
              </span>
            </h2>

            <p className="mx-auto max-w-2xl text-gray-300">
              Instantly transform your team's conversations into organized tasks and streamline your workflow.
            </p>
            <div className="items-center justify-center space-y-3 gap-x-3 sm:flex sm:space-y-0">
              <span className="relative inline-block overflow-hidden rounded-full p-[1.5px]">
                <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#E2CBFF_0%,#393BB2_50%,#E2CBFF_100%)]" />
                <div className="inline-flex h-full w-full cursor-pointer items-center justify-center rounded-full bg-gray-950 text-xs font-medium text-gray-50 backdrop-blur-3xl">
                  <LoginButton />
                </div>
              </span>
            </div>
          </div>
          <div className="mx-10 mt-32">
            <div className="relative aspect-video w-full max-w-4xl mx-auto">
              <div className="relative bg-gray-800 p-6 rounded-3xl shadow-2xl border-2 border-gray-700">
                <div className="relative overflow-hidden rounded-2xl bg-black">
                  <iframe
                    src="https://www.youtube.com/embed/hdAvRx74J-o?autoplay=1&mute=1&loop=1&playlist=hdAvRx74J-o"
                    title="GitPulse Demo"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="w-full aspect-video"
                  />
                </div>
                <div className="absolute top-3 left-1/2 transform -translate-x-1/2 w-20 h-1 bg-gray-600 rounded-full"></div>
                <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 w-12 h-1 bg-gray-600 rounded-full"></div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
