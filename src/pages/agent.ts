import { Context } from 'hono';
import { layout } from '../lib/html';
import { siteConfig } from '../../config/site.config';

const { business } = siteConfig;

export const agentPage = (c: Context) => {
  const content = `
    <section style="padding: 2rem; min-height: calc(100vh - 200px);">
      <div class="container" style="max-width: 900px;">
        <div class="card" style="padding: 0; overflow: hidden;">
          <!-- Chat Header -->
          <div style="
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            color: white;
            padding: 1.5rem;
            display: flex;
            align-items: center;
            gap: 1rem;
          ">
            <img 
              src="/api/assets/beaver-avatar.png" 
              alt="${business.name}"
              style="width: 60px; height: 60px; border-radius: 50%; border: 3px solid white;"
            >
            <div>
              <h1 style="font-family: 'Playfair Display', serif; font-size: 1.5rem; margin: 0;">
                Chat with ${business.name}
              </h1>
              <p style="margin: 0; opacity: 0.9; font-size: 0.9rem;">
                🟢 Online • Usually responds instantly
              </p>
            </div>
          </div>
          
          <!-- Chat Messages -->
          <div id="chat-messages" style="
            height: 400px;
            overflow-y: auto;
            padding: 1.5rem;
            background: #fafafa;
            display: flex;
            flex-direction: column;
            gap: 1rem;
          ">
            <!-- AI Welcome Message -->
            <div style="display: flex; gap: 0.75rem; align-items: flex-start;">
              <img 
                src="/api/assets/beaver-avatar.png" 
                alt="Beaver"
                style="width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;"
              >
              <div style="
                background: white;
                padding: 1rem;
                border-radius: 12px 12px 12px 0;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                max-width: 80%;
              ">
                <p style="margin: 0; color: #333;">
                  Hey there! 🦫 I'm the Handy Beaver's AI assistant. I can help you with:
                </p>
                <ul style="margin: 0.75rem 0 0 1.25rem; color: #555;">
                  <li>Getting a quote for your project</li>
                  <li>Scheduling a consultation</li>
                  <li>Answering questions about our services</li>
                  <li>Visualizing your finished project with AI</li>
                </ul>
                <p style="margin: 0.75rem 0 0; color: #333;">
                  What can I help you with today?
                </p>
              </div>
            </div>
          </div>
          
          <!-- Quick Actions -->
          <div style="padding: 1rem; background: #f5f5f5; border-top: 1px solid #eee;">
            <p style="font-size: 0.85rem; color: #666; margin-bottom: 0.75rem;">Quick actions:</p>
            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
              <button class="quick-action" data-msg="I need a quote for a project">💰 Get a Quote</button>
              <button class="quick-action" data-msg="What services do you offer?">📋 View Services</button>
              <button class="quick-action" data-msg="I'd like to schedule a consultation">📅 Schedule</button>
              <button class="quick-action" data-msg="I want to try the AI visualizer">✨ AI Visualizer</button>
            </div>
          </div>
          
          <!-- Chat Input -->
          <div style="padding: 1rem; border-top: 1px solid #eee; display: flex; gap: 0.75rem;">
            <input 
              type="text" 
              id="chat-input"
              placeholder="Type your message..."
              style="
                flex: 1;
                padding: 0.75rem 1rem;
                border: 2px solid #ddd;
                border-radius: 24px;
                font-size: 1rem;
                outline: none;
              "
            >
            <button 
              id="send-btn"
              style="
                background: var(--primary);
                color: white;
                border: none;
                border-radius: 50%;
                width: 48px;
                height: 48px;
                cursor: pointer;
                font-size: 1.25rem;
                display: flex;
                align-items: center;
                justify-content: center;
              "
            >
              ➤
            </button>
          </div>
        </div>
        
        <!-- Info Cards -->
        <div class="grid grid-3" style="margin-top: 2rem;">
          <div class="card" style="text-align: center;">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">🏠</div>
            <h3 style="color: var(--primary); margin-bottom: 0.5rem;">Service Area</h3>
            <p style="color: #666; font-size: 0.9rem;">${business.serviceArea}</p>
          </div>
          <div class="card" style="text-align: center;">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">⏰</div>
            <h3 style="color: var(--primary); margin-bottom: 0.5rem;">Response Time</h3>
            <p style="color: #666; font-size: 0.9rem;">Usually within 24 hours</p>
          </div>
          <div class="card" style="text-align: center;">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">💬</div>
            <h3 style="color: var(--primary); margin-bottom: 0.5rem;">Real Person</h3>
            <p style="color: #666; font-size: 0.9rem;">AI helps, human decides</p>
          </div>
        </div>
      </div>
    </section>
    
    <style>
      .quick-action {
        background: white;
        border: 1px solid #ddd;
        padding: 0.5rem 1rem;
        border-radius: 20px;
        cursor: pointer;
        font-size: 0.85rem;
        transition: all 0.2s;
      }
      .quick-action:hover {
        background: var(--primary);
        color: white;
        border-color: var(--primary);
      }
      #chat-input:focus {
        border-color: var(--primary);
      }
      #send-btn:hover {
        opacity: 0.9;
        transform: scale(1.05);
      }
      .user-message {
        display: flex;
        justify-content: flex-end;
      }
      .user-message .msg-content {
        background: var(--primary);
        color: white;
        padding: 1rem;
        border-radius: 12px 12px 0 12px;
        max-width: 80%;
      }
      .bot-message {
        display: flex;
        gap: 0.75rem;
        align-items: flex-start;
      }
      .bot-message img {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .bot-message .msg-content {
        background: white;
        padding: 1rem;
        border-radius: 12px 12px 12px 0;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        max-width: 80%;
        color: #333;
      }
      .typing-indicator {
        display: flex;
        gap: 0.25rem;
        padding: 0.5rem;
      }
      .typing-indicator span {
        width: 8px;
        height: 8px;
        background: #999;
        border-radius: 50%;
        animation: bounce 1.4s infinite ease-in-out;
      }
      .typing-indicator span:nth-child(1) { animation-delay: 0s; }
      .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
      .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
      @keyframes bounce {
        0%, 80%, 100% { transform: scale(0); }
        40% { transform: scale(1); }
      }
    </style>
    
    <script>
      const messagesContainer = document.getElementById('chat-messages');
      const chatInput = document.getElementById('chat-input');
      const sendBtn = document.getElementById('send-btn');
      
      // Quick actions
      document.querySelectorAll('.quick-action').forEach(btn => {
        btn.addEventListener('click', () => {
          const msg = btn.dataset.msg;
          chatInput.value = msg;
          sendMessage();
        });
      });
      
      // Send on enter
      chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
      });
      
      sendBtn.addEventListener('click', sendMessage);
      
      function addMessage(content, isUser = false) {
        const div = document.createElement('div');
        div.className = isUser ? 'user-message' : 'bot-message';
        
        if (isUser) {
          div.innerHTML = \`<div class="msg-content">\${content}</div>\`;
        } else {
          div.innerHTML = \`
            <img src="/api/assets/beaver-avatar.png" alt="Beaver">
            <div class="msg-content">\${content}</div>
          \`;
        }
        
        messagesContainer.appendChild(div);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
      
      function showTyping() {
        const div = document.createElement('div');
        div.className = 'bot-message';
        div.id = 'typing';
        div.innerHTML = \`
          <img src="/api/assets/beaver-avatar.png" alt="Beaver">
          <div class="msg-content">
            <div class="typing-indicator">
              <span></span><span></span><span></span>
            </div>
          </div>
        \`;
        messagesContainer.appendChild(div);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
      
      function hideTyping() {
        const typing = document.getElementById('typing');
        if (typing) typing.remove();
      }
      
      async function sendMessage() {
        const message = chatInput.value.trim();
        if (!message) return;
        
        addMessage(message, true);
        chatInput.value = '';
        showTyping();
        
        // TODO: Call /api/chat endpoint
        // For now, simulate response
        setTimeout(() => {
          hideTyping();
          
          let response = '';
          const lower = message.toLowerCase();
          
          if (lower.includes('quote') || lower.includes('price') || lower.includes('cost')) {
            response = "Great! I'd love to help you get a quote. To give you an accurate estimate, I'll need a few details:<br><br>" +
              "1. What type of work? (trim, flooring, deck, general)<br>" +
              "2. Brief description of the project<br>" +
              "3. Your general location in SE Oklahoma<br><br>" +
              "Or you can <a href='/contact' style='color: var(--secondary)'>fill out our quote form</a> with photos!";
          } else if (lower.includes('service')) {
            response = "We offer several services:<br><br>" +
              "🪵 <strong>Trim Carpentry</strong> - Crown molding, baseboards, door trim<br>" +
              "🏠 <strong>Flooring</strong> - Install, repair, refinish<br>" +
              "🛠️ <strong>Deck Repair</strong> - Boards, rails, staining<br>" +
              "🔧 <strong>General Maintenance</strong> - Home repairs<br><br>" +
              "<a href='/services' style='color: var(--secondary)'>View all services & pricing →</a>";
          } else if (lower.includes('schedule') || lower.includes('appointment')) {
            response = "I can help set up a consultation! 📅<br><br>" +
              "The owner will reach out within 24 hours to confirm a time that works for you.<br><br>" +
              "<a href='/contact' style='color: var(--secondary)'>Request a consultation →</a>";
          } else if (lower.includes('visualiz')) {
            response = "Our AI Visualizer is awesome! ✨<br><br>" +
              "Upload a photo of your space and describe what you want done. The AI will show you what it could look like when finished!<br><br>" +
              "New visitors get 3 free visualizations. Customers get unlimited access.<br><br>" +
              "<a href='/visualize' style='color: var(--secondary)'>Try the AI Visualizer →</a>";
          } else {
            response = "Thanks for your message! I'm still learning, but I can help with:<br><br>" +
              "• Getting a quote<br>• Our services & pricing<br>• Scheduling a consultation<br>• Using the AI visualizer<br><br>" +
              "What would you like to know more about?";
          }
          
          addMessage(response);
        }, 1500);
      }
    </script>
  `;
  
  return c.html(layout('Chat with Us', content, 'agent'));
};
