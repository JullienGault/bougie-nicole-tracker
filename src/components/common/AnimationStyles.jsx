// src/components/common/AnimationStyles.jsx
import React from 'react';

const AnimationStyles = () => (
    <style>{`
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        .animate-fade-in{animation:fadeIn .5s ease-in-out}
        @keyframes fadeInUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .animate-fade-in-up{animation:fadeInUp .5s ease-out forwards}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        .animate-spin{animation:spin 1s linear infinite}
        .custom-scrollbar::-webkit-scrollbar{width:8px}
        .custom-scrollbar::-webkit-scrollbar-track{background:#1f2937}
        .custom-scrollbar::-webkit-scrollbar-thumb{background:#4f46e5;border-radius:10px}
    `}</style>
);

export default AnimationStyles;
