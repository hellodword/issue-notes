# https://stackoverflow.com/questions/45890913/how-to-do-base64-encoding-in-jekyll
require "base64"

module Base64Filter
  def base64_encode (input)
    # https://stackoverflow.com/questions/2620975/strange-n-in-base64-encoded-string-in-ruby
    Base64.strict_encode64(input)
  end
  def base64_decode (input)
    # https://ruby-doc.org/stdlib-2.4.1/libdoc/base64/rdoc/Base64.html
    Base64.decode64(input)
  end
end

Liquid::Template.register_filter(Base64Filter) # register filter globally