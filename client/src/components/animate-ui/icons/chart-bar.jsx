'use client';;
import * as React from 'react';
import { motion } from 'motion/react';

import { getVariants, useAnimateIconContext, IconWrapper } from '@/components/animate-ui/icons/icon';

const animations = {
  default: (() => {
    const animation = {
      path4: {},
    };

    for (let i = 1; i <= 3; i++) {
      animation[`path${i}`] = {
        initial: { opacity: 1 },
        animate: {
          opacity: [0, 1],
          pathLength: [0, 1],
          transition: {
            ease: 'easeInOut',
            duration: 0.4,
            delay: (i - 1) * 0.3,
          },
        },
      };
    }

    return animation;
  })(),

  'default-loop': (() => {
    const n = 3;
    const delayStep = 0.3;
    const segDuration = 0.4;

    const startOut = (i) => (n - i) * delayStep;
    const endOut = (i) => startOut(i) + segDuration;

    const outTotal = Math.max(...Array.from({ length: n }, (_, k) => endOut(k + 1)));

    const startIn = (i) => outTotal + (i - 1) * delayStep;
    const endIn = (i) => startIn(i) + segDuration;

    const totalDuration = Math.max(...Array.from({ length: n }, (_, k) => endIn(k + 1)));

    const animation = {};

    for (let i = 1; i <= n; i++) {
      const tSO = startOut(i) / totalDuration;
      const tEO = endOut(i) / totalDuration;
      const tSI = startIn(i) / totalDuration;
      const tEI = endIn(i) / totalDuration;

      animation[`path${i}`] = {
        initial: { opacity: 1, pathLength: 1 },
        animate: {
          pathLength: [1, 1, 0, 0, 1],
          opacity: [1, 1, 0, 0, 1],
          transition: {
            ease: 'easeInOut',
            duration: totalDuration,
            times: [0, tSO, tEO, tSI, tEI],
          },
        },
      };
    }

    return animation;
  })(),

  increasing: {
    path1: {
      initial: { d: 'M7 6h3' },
      animate: {
        d: 'M7 6h3',
        transition: { duration: 0.5, ease: 'easeInOut' },
      },
    },

    path2: {
      initial: { d: 'M7 11h12' },
      animate: {
        d: 'M7 11h8',
        transition: { duration: 0.5, ease: 'easeInOut' },
      },
    },

    path3: {
      initial: { d: 'M7 16h8' },
      animate: {
        d: 'M7 16h12',
        transition: { duration: 0.5, ease: 'easeInOut' },
      },
    }
  },

  decreasing: {
    path1: {
      initial: { d: 'M7 6h3' },
      animate: {
        d: 'M7 6h12',
        transition: { duration: 0.5, ease: 'easeInOut' },
      },
    },

    path2: {
      initial: { d: 'M7 11h12' },
      animate: {
        d: 'M7 11h8',
        transition: { duration: 0.5, ease: 'easeInOut' },
      },
    },

    path3: {
      initial: { d: 'M7 16h8' },
      animate: {
        d: 'M7 16h3',
        transition: { duration: 0.5, ease: 'easeInOut' },
      },
    }
  }
};

function IconComponent({
  size,
  ...props
}) {
  const { controls } = useAnimateIconContext();
  const variants = getVariants(animations);

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}>
      <motion.path d="M7 6h3" variants={variants.path1} initial="initial" animate={controls} />
      <motion.path
        d="M7 11h12"
        variants={variants.path2}
        initial="initial"
        animate={controls} />
      <motion.path
        d="M7 16h8"
        variants={variants.path3}
        initial="initial"
        animate={controls} />
      <motion.path
        d="M3 3v16a2 2 0 0 0 2 2h16"
        variants={variants.path4}
        initial="initial"
        animate={controls} />
    </motion.svg>
  );
}

function ChartBar(props) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export { animations, ChartBar, ChartBar as ChartBarIcon };
