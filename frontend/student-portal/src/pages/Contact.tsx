import { useState, useEffect, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { submitContactForm } from '@/api/client';
import {
  MapPin,
  Mail,
  Send,
  Loader2,
  CheckCircle,
  Facebook,
  Instagram,
} from 'lucide-react';

export default function Contact() {
  const { t } = useTranslation(['common', 'pages', 'legal']);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Contact Us — Delta SPMU Academy';
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await submitContactForm({ name, email, subject, message });
      setIsSuccess(true);
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
      setTimeout(() => setIsSuccess(false), 5000);
    } catch (err) {
      const apiMsg =
        (err as { response?: { data?: { message?: string; _server_messages?: string } } })
          .response?.data?.message ||
        'We could not deliver your message. Please try again in a moment.';
      setErrorMessage(apiMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-alabaster">
      {/* Header */}
      <div className="bg-dark text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="font-heading text-3xl sm:text-4xl font-bold mb-2">
            Contact Us
          </h1>
          <p className="text-gray-300 text-lg">
            We would love to hear from you
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-white rounded-xl shadow-sm p-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
            {/* Contact Info */}
            <div className="lg:col-span-2 space-y-8">
              <div>
                <h2 className="font-heading text-xl font-bold text-dark mb-4">
                  Get in Touch
                </h2>
                <p className="text-dark/60 text-sm leading-relaxed">
                  Have a question about our courses, need technical support, or
                  want to learn more about Delta SPMU Academy? Reach out and
                  we will get back to you as soon as possible.
                </p>
              </div>

              <div className="space-y-5">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-heading font-semibold text-dark text-sm">
                      Location
                    </h3>
                    <p className="text-dark/60 text-sm">
                      Addis Ababa, Ethiopia
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-heading font-semibold text-dark text-sm">
                      Email
                    </h3>
                    <a
                      href="mailto:info@deltaspmu.com"
                      className="text-primary text-sm hover:underline"
                    >
                      info@deltaspmu.com
                    </a>
                  </div>
                </div>
              </div>

              {/* Social Links */}
              <div>
                <h3 className="font-heading font-semibold text-dark text-sm mb-3">
                  Follow Us
                </h3>
                <div className="flex items-center gap-3">
                  <a
                    href="https://facebook.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-dark/60 hover:bg-primary hover:text-dark transition-colors"
                    aria-label="Facebook"
                  >
                    <Facebook className="w-4 h-4" />
                  </a>
                  <a
                    href="https://instagram.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-dark/60 hover:bg-primary hover:text-dark transition-colors"
                    aria-label="Instagram"
                  >
                    <Instagram className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* Map placeholder */}
              <div className="bg-gray-100 rounded-lg p-6 text-center">
                <MapPin className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-dark/40 text-sm">
                  Addis Ababa, Ethiopia
                </p>
              </div>
            </div>

            {/* Contact Form */}
            <div className="lg:col-span-3">
              <h2 className="font-heading text-xl font-bold text-dark mb-6">
                Send a Message
              </h2>

              {isSuccess && (
                <div className="mb-6 flex items-center gap-3 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
                  <CheckCircle className="w-5 h-5 flex-shrink-0" />
                  <p>
                    Thank you for your message! We will get back to you shortly.
                  </p>
                </div>
              )}

              {errorMessage && (
                <div className="mb-6 flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  <p>{errorMessage}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Name */}
                <div>
                  <label
                    htmlFor="contact-name"
                    className="block text-sm font-medium text-dark/80 mb-1.5"
                  >
                    Name
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name"
                    className="w-full rounded-lg border border-dark/10 bg-white py-2.5 px-4 text-dark placeholder:text-dark/30 transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>

                {/* Email */}
                <div>
                  <label
                    htmlFor="contact-email"
                    className="block text-sm font-medium text-dark/80 mb-1.5"
                  >
                    Email
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-lg border border-dark/10 bg-white py-2.5 px-4 text-dark placeholder:text-dark/30 transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>

                {/* Subject */}
                <div>
                  <label
                    htmlFor="contact-subject"
                    className="block text-sm font-medium text-dark/80 mb-1.5"
                  >
                    Subject
                  </label>
                  <select
                    id="contact-subject"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full rounded-lg border border-dark/10 bg-white py-2.5 px-4 text-dark transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none appearance-none cursor-pointer"
                  >
                    <option value="">Select a subject</option>
                    <option value="general">General Inquiry</option>
                    <option value="courses">Course Information</option>
                    <option value="technical">Technical Support</option>
                    <option value="payment">Payment Issue</option>
                  </select>
                </div>

                {/* Message */}
                <div>
                  <label
                    htmlFor="contact-message"
                    className="block text-sm font-medium text-dark/80 mb-1.5"
                  >
                    Message
                  </label>
                  <textarea
                    id="contact-message"
                    required
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="How can we help you?"
                    className="w-full rounded-lg border border-dark/10 bg-white py-2.5 px-4 text-dark placeholder:text-dark/30 transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none resize-y"
                  />
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-lg bg-primary py-2.5 text-dark font-medium transition-all hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Send Message
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
