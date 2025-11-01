// thanks to oliver: https://www.youtube.com/@olivierlarose1
"use client";
import { ReactLenis } from 'lenis/react';
import { useTransform, motion, useScroll, MotionValue } from 'framer-motion';
import PixelBlast from '@/components/PixelBlast';
import GridPatternDemo from '@/components/grid-pattern-demo';
import { useRef, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// dynamically import lottie-react client-side to avoid HMR/module-factory issues
const Lottie = dynamic(() => import('lottie-react'), { ssr: false });
import Image from 'next/image';
const projects = [
  {
    title: 'Repo Based Chatrooms',
    description:
      'Each Respository Gets Its Own Real Time Chat Synced With All Collaborators',
    src: 'github-login-copy.png',
    link: '/assets/github-login-copy.png',
    color: '#5196fd',
  },
  {
    title: 'Github Login',
    description:
      'Secure Sign-in with Firebase Github Oauth. Start Collaborating in seconds.',
    src: 'github-login.png',
    link: '/assets/github-login.png',
    color: '#8f89ff',
  },
  {
    title: 'Ai Driven Issue Detection',
    description:
      'Gitpulse listen to converstion and identifies bugs,features requests, or tasks.',
    src: 'github.jpg',
    link: '/assets/github.jpg',
    color: '#13006c',
  },
  {
    title: 'Auto Github Issue Creation',
    description:
      'Automatically converts deteced issues into Github issues -no manual typing.',
    src: 'kanban.jpeg',
    link: '/assets/kanban.jpeg',
    color: '#ed649e',
  },
  {
    title: 'Realtime Kanban Board',
    description:
      'Drag,Drop and track progress instantly with firestore-powered sync.',
    src: 'repo.webp',
    link: '/assets/repo.webp',
    color: '#fd521a',
  },
];
export default function index(): JSX.Element {
  const container = useRef(null);
  const { scrollYProgress } = useScroll({
    target: container,
    offset: ['start start', 'end end'],
  });
  return (
    <ReactLenis root>
  <main className='bg-transparent relative' ref={container}>
        
        {/* Decorative GridPatternDemo background (replaces PixelBlast) */}
  <div className='absolute inset-0 -z-20'>
         {/* lighter shade of blue for features background */}
         <GridPatternDemo bgColor='#072d67ff' gridClassName='opacity-80' />
        </div>
        <>
          <section className='text-white  h-[70vh]  w-full bg-transparent  grid place-content-center '>
            <div className='absolute bottom-0 left-0 right-0 top-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-size-[54px_54px] mask-[radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]'></div>

            <h1 className='2xl:text-7xl text-5xl px-8 font-semibold text-center tracking-tight leading-[120%]'>
              Stacking Cards Using <br /> Motion. Scroll down! 👇
            </h1>
          </section>
        </>

  <section className='text-white w-full bg-transparent '>
          {/* two-column layout: left = stacked cards, right = sticky Lottie animation */}
          <div className='container mx-auto px-6 py-12 flex flex-col md:flex-row gap-8'>
            <div className='md:flex-1'>
              {projects.map((project, i) => {
                const targetScale = 1 - (projects.length - i) * 0.05;
                return (
                  <Card
                    key={`p_${i}`}
                    i={i}
                    url={project?.link}
                    src={project?.src}
                    title={project?.title}
                    color={project?.color}
                    description={project?.description}
                    progress={scrollYProgress}
                    range={[i * 0.25, 1]}
                    targetScale={targetScale}
                  />
                );
              })}
            </div>

            <aside className='hidden md:block w-full md:w-[36%] lg:w-[32%]'>
              <div className='sticky top-[18vh] h-[64vh] flex items-center justify-center'>
                <AnimationPanel />
              </div>
            </aside>
          </div>
        </section>

        <footer className='group bg-slate-950 '>
          <h1 className='text-[10vw] translate-y-8 leading-[100%] uppercase font-semibold text-center bg-linear-to-r from-gray-400 to-gray-800 bg-clip-text text-transparent transition-all ease-linear'>
            ui-layout
          </h1>
          <div className='bg-blue-200 h-24 relative z-10 grid place-content-center text-2xl rounded-tr-full rounded-tl-full'></div>
        </footer>
      </main>
    </ReactLenis>
  );
}
interface CardProps {
  i: number;
  title: string;
  description: string;
  src: string;
  url: string;
  color: string;
  progress: MotionValue<number>;
  range: [number, number];
  targetScale: number;
}
export const Card: React.FC<CardProps> = ({
  i,
  title,
  description,
  src,
  url,
  color,
  progress,
  range,
  targetScale,
}) => {
  const container = useRef(null);
  const { scrollYProgress } = useScroll({
    target: container,
    offset: ['start end', 'start start'],
  });

  const imageScale = useTransform(scrollYProgress, [0, 1], [2, 1]);
  const scale = useTransform(progress, range, [1, targetScale]);

  return (
    <div
      ref={container}
      className='h-screen flex items-center sticky top-0'
    >
      <motion.div
        style={{
          backgroundColor: color,
          scale,
          top: `calc(-5vh + ${i * 25}px)`,
        }}
        className={`flex flex-col relative -top-[25%] h-[450px] w-[60%] ml-8 md:ml-20 rounded-md lg:p-10 sm:p-4 p-4 origin-top`}
      >
        <h2 className='text-3xl md:text-4xl text-left font-semibold'>{title}</h2>
        <div className={`flex h-full mt-5 gap-10`}>
          <div className={`w-[55%] relative top-[6%]`}>
            <p className='text-base md:text-lg'>{description}</p>
            <span className='flex items-center gap-2 pt-2'>
              <a
                href={'#'}
                target='_blank'
                className='underline cursor-pointer'
              >
                See more
              </a>
              <svg
                width='22'
                height='12'
                viewBox='0 0 22 12'
                fill='none'
                xmlns='http://www.w3.org/2000/svg'
              >
                <path
                  d='M21.5303 6.53033C21.8232 6.23744 21.8232 5.76256 21.5303 5.46967L16.7574 0.696699C16.4645 0.403806 15.9896 0.403806 15.6967 0.696699C15.4038 0.989592 15.4038 1.46447 15.6967 1.75736L19.9393 6L15.6967 10.2426C15.4038 10.5355 15.4038 11.0104 15.6967 11.3033C15.9896 11.5962 16.4645 11.5962 16.7574 11.3033L21.5303 6.53033ZM0 6.75L21 6.75V5.25L0 5.25L0 6.75Z'
                  fill='black'
                />
              </svg>
            </span>
          </div>

          <div
            className={`relative w-[45%] h-full rounded-lg overflow-hidden flex items-center justify-center`}
          >
            <motion.div
              className={`w-full h-full`}
              style={{ scale: imageScale }}
            >
              <Image fill src={url} alt='image' className='object-cover' />
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

function AnimationPanel() {
  const [animationData, setAnimationData] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    // public/ assets are served from /assets
    fetch('/assets/Ai-powered%20marketing%20tools%20abstract.json')
      .then((res) => res.json())
      .then((json) => {
        if (mounted) setAnimationData(json);
      })
      .catch(() => {
        // fallback: try unencoded path
        fetch('/assets/Ai-powered marketing tools abstract.json')
          .then((res) => res.json())
          .then((json) => {
            if (mounted) setAnimationData(json);
          })
          .catch(() => {
            /* ignore */
          });
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className='w-full h-full flex items-center justify-center'>
      {animationData ? (
        <div className='w-[90%] h-[90%] max-w-[420px] max-h-[720px]'>
          <Lottie animationData={animationData} loop={true} />
        </div>
      ) : (
        <div className='w-[220px] h-[220px] bg-gray-800 rounded-md flex items-center justify-center text-sm text-gray-400'>
          Loading animation...
        </div>
      )}
    </div>
  );
}
