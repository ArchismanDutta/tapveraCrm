'use client';;
import * as React from 'react';
import { motion } from 'motion/react';

import { getVariants, useAnimateIconContext, IconWrapper } from '@/components/animate-ui/icons/icon';

const animations = {
  default: {
    group: {
      initial: {
        x: 0,
        transition: { duration: 0.3, ease: 'easeInOut' },
      },
      animate: {
        x: 2,
        transition: { duration: 0.3, ease: 'easeInOut' },
      },
    },

    path1: {},
    path2: {},
    path3: {}
  },

  'default-loop': {
    group: {
      initial: {
        x: 0,
      },
      animate: {
        x: [0, 2, 0],
        transition: { duration: 0.6, ease: 'easeInOut' },
      },
    },

    path1: {},
    path2: {},
    path3: {}
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
      <motion.g variants={variants.group} initial="initial" animate={controls}>
        <motion.path
          d="m10 17 5-5-5-5"
          variants={variants.path1}
          initial="initial"
          animate={controls} />
        <motion.path
          d="M15 12H3"
          variants={variants.path2}
          initial="initial"
          animate={controls} />
      </motion.g>
      <motion.path
        d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"
        variants={variants.path3}
        initial="initial"
        animate={controls} />
    </motion.svg>
  );
}

function LogIn(props) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export { animations, LogIn, LogIn as LogInIcon };
