import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChevronDown, Mail } from 'lucide-react';

/* ------------------------------------------------------------------ */
/* FAQ Data                                                           */
/* ------------------------------------------------------------------ */

interface FAQ {
  question: string;
  answer: string;
}

interface FAQSection {
  title: string;
  items: FAQ[];
}

const FAQ_DATA: FAQSection[] = [
  {
    title: 'Getting Started',
    items: [
      {
        question: 'How do I create an account?',
        answer:
          'Click the "Sign Up" button on the homepage or visit the registration page. Fill in your name, email, and password, then verify your email address through the confirmation link we send you.',
      },
      {
        question: 'How do I enroll in a course?',
        answer:
          'Browse our course catalog, select the course you are interested in, and click "Enroll Now." Complete the payment process using one of our supported payment methods, and you will get immediate access.',
      },
      {
        question: 'What payment methods are accepted?',
        answer:
          'We accept payments through telebirr, Chapa, and EthSwitch (CBE Birr). All transactions are processed securely through our authorized payment providers.',
      },
    ],
  },
  {
    title: 'Courses & Learning',
    items: [
      {
        question: 'How long do I have access to a course?',
        answer:
          'Course access is granted for 30 days from the date of purchase. You can extend your access by purchasing additional time if needed.',
      },
      {
        question: 'Can I download course videos?',
        answer:
          'Course videos are available for streaming only and cannot be downloaded. This protects the intellectual property of our instructors and ensures content remains up to date.',
      },
      {
        question: 'How do I get my certificate?',
        answer:
          'Complete all lessons and pass the final assessment with the required score. Your certificate will be automatically generated and available for download from your dashboard.',
      },
      {
        question: 'What is the passing score for quizzes?',
        answer:
          'The passing score varies by course but is typically 70% or higher. You can retake quizzes to improve your score within your access period.',
      },
    ],
  },
  {
    title: 'Account & Billing',
    items: [
      {
        question: 'How do I reset my password?',
        answer:
          'Click "Forgot Password" on the login page and enter your email address. We will send you a password reset link that is valid for 24 hours.',
      },
      {
        question: 'How do I update my profile?',
        answer:
          'Go to your dashboard and click on "Profile" or the settings icon. You can update your name, profile picture, phone number, and other personal details.',
      },
      {
        question: 'Can I get a refund?',
        answer:
          'Refund requests must be made within 7 days of purchase and before you have accessed more than 25% of the course content. Visit our Refund Policy page for full details.',
      },
      {
        question: 'How do I delete my account?',
        answer:
          'Contact our support team at support@deltaspmu.com to request account deletion. Please note that this action is permanent and you will lose access to all purchased courses.',
      },
    ],
  },
  {
    title: 'Technical Support',
    items: [
      {
        question: 'Video not playing?',
        answer:
          'Try refreshing the page, clearing your browser cache, or switching to a different browser. Make sure you have a stable internet connection. If the issue persists, contact our support team.',
      },
      {
        question: 'Payment not going through?',
        answer:
          'Verify that you have sufficient balance in your payment account. Check that you are entering the correct payment details. If the issue continues, try a different payment method or contact support.',
      },
      {
        question: "Can't access my course?",
        answer:
          'Ensure your course access period has not expired. Try logging out and back in. If the problem continues, contact support with your transaction ID and we will resolve it promptly.',
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Accordion Item                                                     */
/* ------------------------------------------------------------------ */

function AccordionItem({
  question,
  answer,
  isOpen,
  onToggle,
}: FAQ & { isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
        aria-expanded={isOpen}
      >
        <span className="font-medium text-dark text-sm">{question}</span>
        <ChevronDown
          className={`w-4 h-4 text-dark/40 flex-shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      {isOpen && (
        <div className="px-5 pb-4 text-sm text-dark/60 leading-relaxed">
          {answer}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Help Center Page                                                   */
/* ------------------------------------------------------------------ */

export default function Help() {
  const [searchQuery, setSearchQuery] = useState('');
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    document.title = 'Help Center — Delta SPMU Academy';
  }, []);

  const toggleItem = (key: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return FAQ_DATA;

    const query = searchQuery.toLowerCase();
    return FAQ_DATA.map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          item.question.toLowerCase().includes(query) ||
          item.answer.toLowerCase().includes(query)
      ),
    })).filter((section) => section.items.length > 0);
  }, [searchQuery]);

  return (
    <div className="min-h-screen bg-alabaster">
      {/* Header */}
      <div className="bg-dark text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="font-heading text-3xl sm:text-4xl font-bold mb-2">
            Help Center
          </h1>
          <p className="text-gray-300 text-lg">
            Find answers to common questions
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-white rounded-xl shadow-sm p-8">
          {/* Search */}
          <div className="relative mb-8">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for help..."
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            />
          </div>

          {/* FAQ Sections */}
          {filteredSections.length === 0 ? (
            <div className="text-center py-12">
              <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-dark/60 text-sm">
                No results found for "{searchQuery}". Try a different search
                term.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {filteredSections.map((section) => (
                <div key={section.title}>
                  <h2 className="font-heading text-lg font-bold text-dark mb-4">
                    {section.title}
                  </h2>
                  <div className="space-y-2">
                    {section.items.map((item) => {
                      const key = `${section.title}-${item.question}`;
                      return (
                        <AccordionItem
                          key={key}
                          question={item.question}
                          answer={item.answer}
                          isOpen={openItems.has(key)}
                          onToggle={() => toggleItem(key)}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Contact Section */}
          <div className="mt-10 pt-8 border-t border-gray-100 text-center">
            <h2 className="font-heading text-lg font-bold text-dark mb-2">
              Still need help?
            </h2>
            <p className="text-dark/60 text-sm mb-4">
              Can't find what you're looking for? Our support team is here to
              help.
            </p>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 bg-primary text-dark font-medium px-6 py-2.5 rounded-lg hover:bg-primary/90 transition-colors text-sm"
            >
              <Mail className="w-4 h-4" />
              Contact Us
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
