'use client';;
import * as React from 'react';
import { motion } from 'motion/react';

import { getVariants, useAnimateIconContext, IconWrapper } from '@/components/animate-ui/icons/icon';

const animations = {
  default: {
    path1: {
      initial: {
        rotate: 0,
        transition: { ease: 'easeInOut', duration: 0.3 },
      },
      animate: {
        transformOrigin: 'bottom left',
        rotate: 70,
        transition: { ease: 'easeInOut', duration: 0.3 },
      },
    },

    path2: {}
  },

  'default-loop': {
    path1: {
      initial: {
        rotate: 0,
        transition: { ease: 'easeInOut', duration: 0.6 },
      },
      animate: {
        transformOrigin: 'bottom left',
        rotate: [0, 70, 0],
        transition: { ease: 'easeInOut', duration: 0.6 },
      },
    },

    path2: {}
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
      <motion.path
        d="m12 14 4-4"
        variants={variants.path1}
        initial="initial"
        animate={controls} />
      <motion.path
        d="M3.34 19a10 10 0 1 1 17.32 0"
        variants={variants.path2}
        initial="initial"
        animate={controls} />
    </motion.svg>
  );
}

function Gauge(props) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export { animations, Gauge, Gauge as GaugeIcon };
