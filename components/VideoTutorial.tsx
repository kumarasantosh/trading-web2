import React from 'react'

interface VideoTutorialProps {
    className?: string;
}

const VideoTutorial: React.FC<VideoTutorialProps> = ({ className = '' }) => {
    return (
        <div className={`mt-6 ${className}`}>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <details className="group">
                    <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="bg-red-100 p-2 rounded-full">
                                <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
                                </svg>
                            </div>
                            <span className="font-semibold text-gray-700">How to use this page?</span>
                        </div>
                        <svg
                            className="w-5 h-5 text-gray-500 transform group-open:rotate-180 transition-transform duration-200"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </summary>
                    <div className="p-4 border-t border-gray-100 bg-gray-50 flex flex-col items-center gap-4">
                        <p className="text-gray-600 text-center max-w-2xl px-4">
                            Watch this short tutorial to learn how to effectively use this page. Discover how to analyze trends, filter data, and get the most out of the features provided.
                        </p>
                        <div className="w-full max-w-4xl aspect-video rounded-lg overflow-hidden shadow-lg">
                            <iframe
                                className="w-full h-full"
                                src="https://www.youtube.com/embed/p5ORIeMULIg"
                                title="How to use this page"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            ></iframe>
                        </div>
                    </div>
                </details>
            </div>
        </div>
    )
}

export default VideoTutorial
